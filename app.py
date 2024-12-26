#! /usr/bin/env python3

from flask import Flask, render_template, jsonify, request
from datetime import datetime
from ldap3 import Server, Connection, SUBTREE, Tls
import ssl
from dotenv import load_dotenv
import os
import json

def parse_ldap_mappings():
    """Parse LDAP attribute mappings from environment variable"""
    mapping_str = os.getenv('LDAP_ATTRIBUTES', 'id:cn name:displayName email:mail jobtitle:title department:department uidNumber:uidNumber')
    mappings = {}
    for pair in mapping_str.split():
        app_attr, ldap_attr = pair.split(':')
        mappings[app_attr] = ldap_attr
    return mappings

# Load LDAP attribute mappings
LDAP_ATTR_MAP = parse_ldap_mappings()

# Load environment variables
load_dotenv()

app = Flask(__name__)

def get_ldap_connection():
    ldap_url = os.getenv('LDAP_URL', 'ldap://localhost:389')
    bind_dn = os.getenv('LDAP_BIND_DN')
    password = os.getenv('LDAP_PASSWORD')

    if not bind_dn:
        raise ValueError("LDAP_BIND_DN environment variable must be set")
    
    if not password:
        raise ValueError("LDAP_PASSWORD environment variable must be set")
    
    # Parse LDAP URL to validate protocol and port
    if ldap_url.startswith('ldaps://'):
        use_ssl = True
        default_port = 636
    elif ldap_url.startswith('ldap://'):
        use_ssl = False
        default_port = 389
    else:
        raise ValueError("LDAP_URL must start with ldap:// or ldaps://")
    
    # Extract port from URL if present, otherwise use default
    port = default_port
    if ':' in ldap_url.split('//')[1]:
        try:
            port = int(ldap_url.split(':')[-1])
        except ValueError:
            raise ValueError(f"Invalid port in LDAP_URL: {ldap_url}")
        
    # Validate port matches protocol
    if use_ssl and port == 389:
        raise ValueError("LDAPS (SSL) connection requested but standard LDAP port (389) specified. Use port 636 for LDAPS.")
    elif not use_ssl and port == 636:
        raise ValueError("Standard LDAP connection requested but LDAPS port (636) specified. Use port 389 for standard LDAP.")
    
    # Check if we should ignore TLS certificate
    ignore_cert = os.getenv('LDAPS_CERT_IGNORE', 'False').lower() == 'true'
    
    try:
        if use_ssl:
            # Create Tls object with proper SSL context configuration
            tls = Tls(validate=ssl.CERT_NONE if ignore_cert else ssl.CERT_REQUIRED,
                     version=ssl.PROTOCOL_TLS_CLIENT)
            
            server = Server(ldap_url,
                          use_ssl=True,
                          tls=tls,
                          get_info=None)
        else:
            server = Server(ldap_url,
                          use_ssl=False,
                          get_info=None)
        
        conn = Connection(
            server,
            user=bind_dn,
            password=password,
            auto_bind=True,
            authentication='SIMPLE'
        )
        return conn
        
    except Exception as e:
        if "EOF occurred in violation of protocol" in str(e):
            raise ValueError("SSL/TLS connection error: Attempting to use LDAPS (SSL) with a non-SSL LDAP server or wrong port.") from e
        raise

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/users/search')
def search_users():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify([])
    
    # Split query into words
    words = query.split()
    
    # Build LDAP filter
    search_attrs = [LDAP_ATTR_MAP[attr] for attr in ['id', 'name', 'email', 'jobtitle', 'department']]
    
    # Build filter for each word
    word_filters = []
    for word in words:
        # Skip empty words
        if not word:
            continue
            
        # For each word, create a filter that matches any attribute
        attr_conditions = []
        for attr in search_attrs:
            attr_conditions.append(f'({attr}=*{word}*)')
        
        # Add uidNumber search if word is numeric
        if word.isdigit() and 'uidNumber' in LDAP_ATTR_MAP:
            attr_conditions.append(f'({LDAP_ATTR_MAP["uidNumber"]}={word})')
        
        if attr_conditions:
            # Combine attribute conditions with OR
            word_filters.append(f'(|{"".join(attr_conditions)})')
    
    # Combine all word filters with AND, including objectClass check
    if word_filters:
        ldap_filter = f'(&(objectClass=person){"".join(word_filters)})'
    else:
        ldap_filter = '(&(objectClass=person)(!(objectClass=*)))'  # Return empty result

    print("LDAP Filter:", ldap_filter)
    
    with get_ldap_connection() as conn:
        # Get all mapped LDAP attributes for the search
        search_attributes = [LDAP_ATTR_MAP[attr] for attr in LDAP_ATTR_MAP.keys()]
        
        conn.search(
            os.getenv('LDAP_BASE_DN_USER'),
            ldap_filter,
            SUBTREE,
            attributes=search_attributes
        )
        
        results = []
        for entry in conn.entries:
            # Check for required attributes
            id_attr = LDAP_ATTR_MAP['id']
            email_attr = LDAP_ATTR_MAP['email']
            
            if not (hasattr(entry, email_attr) and getattr(entry, email_attr).value and 
                   hasattr(entry, id_attr) and getattr(entry, id_attr).value and 
                   getattr(entry, id_attr).value.lower() not in ['null', 'none', 'undefined']):
                continue
                
            # Build the result dictionary
            result = {}
            for app_attr, ldap_attr in LDAP_ATTR_MAP.items():
                if hasattr(entry, ldap_attr):
                    value = getattr(entry, ldap_attr).value
                    result[app_attr] = '' if value in ['null', 'NULL', None, 'undefined', 'UNDEFINED'] else value
                else:
                    result[app_attr] = ''
            
            results.append(result)
                
            
    return jsonify(results)

@app.route('/api/groups/search')
def search_groups():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify([])
    
    # Split the query preserving quoted terms
    import re
    words = []
    # Find all quoted terms and non-quoted words
    matches = re.finditer(r'"([^"]+)"|(\S+)', query)
    for match in matches:
        quoted_term, single_word = match.groups()
        words.append(quoted_term if quoted_term else single_word)
        
    word_filters = []
    for word in words:
        # Build search filter for each word
        field_filters = []
        
        # If word was in quotes, use exact match (no wildcards)
        if word.startswith('"') and word.endswith('"'):
            word = word[1:-1]  # Remove quotes
            field_filters.extend([
                f"(cn={word})",
                f"(description={word})"
            ])
        else:
            field_filters.extend([
                f"(cn=*{word}*)",
                f"(description=*{word}*)"
            ])
        
        # Add gidNumber search if word is numeric
        if word.isdigit():
            field_filters.append(f"(gidNumber={word})")
            
        # Combine field filters with OR
        word_filter = f"(|{''.join(field_filters)})"
        word_filters.append(word_filter)
    
    # Combine with AND to require all words and support both group types
    ldap_filter = f"(&(|(objectClass=posixGroup)(objectClass=group)){''.join(word_filters)})"
    
    with get_ldap_connection() as conn:
        conn.search(
            os.getenv('LDAP_BASE_DN_GROUP'),
            ldap_filter,
            SUBTREE,
            attributes=['cn', 'gidNumber', 'memberUid', 'member', 'description']
        )
        
        results = []
        for entry in conn.entries:
            # Get members list based on available attribute
            members = []
            if hasattr(entry, 'memberUid') and entry.memberUid.values:  # OpenLDAP style
                members = entry.memberUid.values
            elif hasattr(entry, 'member') and entry.member.values:   # AD style
                # Extract CN from each member DN
                for member_dn in entry.member.values:
                    try:
                        # Split DN into components and find the CN
                        dn_parts = [x.strip() for x in member_dn.split(',')]
                        cn_part = next((x for x in dn_parts if x.upper().startswith('CN=')), None)
                        if cn_part:
                            # Extract the CN value after 'CN='
                            cn = cn_part.split('=', 1)[1]
                            members.append(cn)
                    except Exception as e:
                        print(f"Error parsing member DN {member_dn}: {e}")
            
            results.append({
                "id": entry.cn.value,
                "name": entry.cn.value,
                "description": entry.description.value if hasattr(entry, 'description') else "",
                "gidNumber": entry.gidNumber.value if hasattr(entry, 'gidNumber') else None,
                "members": members
            })
            
    return jsonify(results)

@app.route('/api/submit-changes', methods=['POST'])
def submit_changes():
    data = request.json
    group_id = data.get('group')
    user_ids = data.get('users', [])
    
    if not group_id or not user_ids:
        return jsonify({
            "status": "error",
            "message": "Missing group or users"
        }), 400
    
    try:
        with get_ldap_connection() as conn:
            # Find the group DN
            group_filter = f"(&(objectClass=posixGroup)(cn={group_id}))"
            conn.search(
                os.getenv('LDAP_BASE_DN_GROUP'),
                group_filter,
                SUBTREE,
                attributes=['member']
            )
            
            if not conn.entries:
                return jsonify({
                    "status": "error",
                    "message": "Group not found"
                }), 404
                
            group_dn = conn.entries[0].entry_dn
            
            # Add users to group
            for user_id in user_ids:
                user_dn = f"uid={user_id},{os.getenv('LDAP_BASE_DN_USER')}"
                conn.modify(group_dn, {'memberUid': [(2, [user_id])]})  # 2 = MODIFY_ADD
                
        return jsonify({
            "status": "success",
            "message": "Changes submitted successfully",
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0',port=5555,debug=True)
